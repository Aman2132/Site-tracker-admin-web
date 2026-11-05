import JSZip from "jszip";

import { formatDateTime } from "@/lib/format";
import { generatePhotoFilename, sanitizeName } from "@/lib/photoDownload";
import type { CrewMember, Project, Site, SitePhoto } from "@/types/domain";

export interface ExportProgress {
  current: number;
  total: number;
  phase: "downloading" | "zipping";
  percent: number;
  message: string;
}

export interface ExportContext {
  sites: Site[];
  projects: Project[];
  crew: CrewMember[];
  onProgress?: (progress: ExportProgress) => void;
}

/**
 * Escapes values for CSV output according to RFC 4180.
 */
function csvCell(val: unknown): string {
  if (val == null) return '""';
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Downloads a list of photos and packages them into a structured ZIP archive:
 * `{ProjectName}/{SiteName}/{YYYY-MM-DD_HHmmss_task_id.jpg}`
 * Along with a complete `manifest.csv` and `metadata.json`.
 */
export async function exportPhotosToZip(photos: SitePhoto[], context: ExportContext): Promise<void> {
  if (photos.length === 0) {
    throw new Error("No photos to export.");
  }

  const { sites, projects, crew, onProgress } = context;
  const siteById = new Map(sites.map(s => [s.id, s]));
  const projectById = new Map(projects.map(p => [p.id, p]));
  const personById = new Map(crew.map(c => [c.id, c]));

  const zip = new JSZip();
  const total = photos.length;
  let downloadedCount = 0;

  let lastReportTime = 0;
  let lastReportPercent = -1;

  function reportProgress(p: ExportProgress, force = false) {
    if (!onProgress) return;
    const now = Date.now();
    // Throttle updates to at most once per 200ms unless forced or percent changed by >= 2%
    if (!force) {
      if (p.percent === lastReportPercent) return;
      if (now - lastReportTime < 200 && Math.abs(p.percent - lastReportPercent) < 2) return;
    }
    lastReportTime = now;
    lastReportPercent = p.percent;
    onProgress(p);
  }

  // Prepare CSV header and rows
  const csvHeaders = [
    "Relative Path",
    "Filename",
    "Taken At",
    "Project",
    "Site",
    "Worker",
    "Task",
    "Note",
    "Latitude",
    "Longitude",
    "Altitude (m)",
    "Heading (°)",
    "GPS Accuracy (m)",
    "Plus Code",
    "Media Type",
    "Original URL",
  ];
  const csvRows: string[][] = [];
  const jsonRecords: Record<string, unknown>[] = [];

  // Download photos in small concurrent batches
  const CONCURRENCY = 6;
  const queue = [...photos];

  async function worker() {
    while (queue.length > 0) {
      const photo = queue.shift();
      if (!photo) break;

      const site = siteById.get(photo.siteId);
      const project = site?.projectId ? projectById.get(site.projectId) : undefined;
      const person = personById.get(photo.personId);

      const projectName = sanitizeName(project?.name ?? "General_Projects", "General");
      const siteName = sanitizeName(site?.name ?? "Unassigned_Site", "Unassigned");
      const filename = generatePhotoFilename(photo);
      const relativePath = `${projectName}/${siteName}/${filename}`;

      try {
        const response = await fetch(photo.fullUrl);
        if (!response.ok) {
          console.warn(`[export] Could not download photo ${photo.id}: ${response.status}`);
        } else {
          const buffer = await response.arrayBuffer();
          zip.file(relativePath, buffer);
        }
      } catch (err) {
        console.warn(`[export] Error downloading photo ${photo.id}`, err);
      }

      downloadedCount++;
      const percent = Math.round((downloadedCount / total) * 80); // 0-80% for download phase
      reportProgress({
        current: downloadedCount,
        total,
        phase: "downloading",
        percent,
        message: `Downloading photo ${downloadedCount} of ${total}…`,
      }, downloadedCount === total);

      // Record metadata
      csvRows.push([
        relativePath,
        filename,
        formatDateTime(photo.takenAt),
        project?.name ?? "General",
        site?.name ?? "Unassigned",
        person?.name ?? "Unknown",
        photo.task,
        photo.note ?? "",
        photo.lat.toFixed(6),
        photo.lng.toFixed(6),
        photo.altitude != null ? String(photo.altitude) : "",
        photo.heading != null ? String(photo.heading) : "",
        String(photo.accuracy),
        photo.plusCode,
        photo.mediaType,
        photo.fullUrl,
      ]);

      jsonRecords.push({
        relativePath,
        filename,
        takenAt: photo.takenAt,
        takenAtFormatted: formatDateTime(photo.takenAt),
        project: project ? { id: project.id, name: project.name } : null,
        site: site ? { id: site.id, name: site.name } : null,
        worker: person ? { id: person.id, name: person.name } : null,
        task: photo.task,
        note: photo.note ?? null,
        coordinates: { lat: photo.lat, lng: photo.lng },
        altitude: photo.altitude ?? null,
        heading: photo.heading ?? null,
        accuracy: photo.accuracy,
        plusCode: photo.plusCode,
        mediaType: photo.mediaType,
        originalUrl: photo.fullUrl,
      });
    }
  }

  // Run workers concurrently
  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker());
  await Promise.all(workers);

  // Add CSV manifest to the root of the ZIP
  const csvContent = [csvHeaders.map(csvCell).join(","), ...csvRows.map(row => row.map(csvCell).join(","))].join("\r\n");
  zip.file("manifest.csv", "\uFEFF" + csvContent); // Add UTF-8 BOM so Excel opens it with proper encoding

  // Add JSON manifest
  zip.file("metadata.json", JSON.stringify(jsonRecords, null, 2));

  // Generate the ZIP
  reportProgress({
    current: total,
    total,
    phase: "zipping",
    percent: 85,
    message: "Compressing into ZIP archive…",
  }, true);

  const zipBlob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    meta => {
      const percent = 85 + Math.round(meta.percent * 0.15); // 85-100%
      reportProgress({
        current: total,
        total,
        phase: "zipping",
        percent,
        message: `Compressing ZIP… ${Math.round(meta.percent)}%`,
      }, meta.percent >= 100);
    }
  );

  // Trigger browser download
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const zipFilename = `SiteTracker_Photos_${dateStr}.zip`;

  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

