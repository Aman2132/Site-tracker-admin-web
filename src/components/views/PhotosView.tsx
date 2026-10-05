"use client";

import { Check, Crosshair, Download, Film, ImageIcon, Images, Search, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { TextInput } from "@/components/domain/FormBits";
import { Lightbox } from "@/components/domain/Lightbox";
import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState } from "@/components/domain/Panel";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { PhotoThumb } from "@/components/domain/PhotoThumb";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDay } from "@/lib/format";
import { DAY, NOW, istDayStart } from "@/lib/mock/data";
import { useDemoStore, useLookups } from "@/lib/store";
import { cn } from "@/lib/utils";

import type { SitePhoto } from "@/types/domain";

type Range = "today" | "7d" | "all";
type Media = "all" | "photo" | "video";

function dayLabel(day: number) {
  const today = istDayStart(NOW);
  if (day === today) return "Today";
  if (day === today - DAY) return "Yesterday";
  return formatDay(day);
}

export function PhotosView({ initialSite }: { initialSite?: string }) {
  const { photos, sites, crew } = useDemoStore();
  const { personById } = useLookups();
  const [site, setSite] = useState<string>(initialSite && sites.some(s => s.id === initialSite) ? initialSite : "all");
  const [person, setPerson] = useState("all");
  const [range, setRange] = useState<Range>("7d");
  const [media, setMedia] = useState<Media>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const today = istDayStart(NOW);
    const from = range === "today" ? today : range === "7d" ? today - 6 * DAY : 0;
    const q = query.trim().toLowerCase();
    return photos.filter(
      p =>
        p.takenAt >= from &&
        (site === "all" || p.siteId === site) &&
        (person === "all" || p.personId === person) &&
        (media === "all" || p.mediaType === media) &&
        (!q || p.task.toLowerCase().includes(q) || personById.get(p.personId)?.name.toLowerCase().includes(q))
    );
  }, [photos, site, person, range, media, query, personById]);

  const groups = useMemo(() => {
    const map = new Map<number, SitePhoto[]>();
    for (const p of filtered) {
      const d = istDayStart(p.takenAt);
      map.set(d, [...(map.get(d) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const contributors = new Set(filtered.map(p => p.personId)).size;
  const precise = filtered.length ? filtered.filter(p => p.accuracy <= 20).length / filtered.length : 0;
  const selectedPerson = person === "all" ? null : personById.get(person);
  const hasFilters = site !== "all" || person !== "all" || media !== "all" || query !== "";
  const photographers = crew.filter(c => photos.some(p => p.personId === c.id));

  return (
    <>
      <PageHeader
        title="Photos"
        description="Every geotagged capture, filed by site and by who took it. Thumbnails load first; the full-resolution original loads when you open one."
        actions={
          <Button
            variant="outline"
            size="lg"
            className="rounded-xl bg-card"
            onClick={() => toast.success("Export started", { description: `${filtered.length} originals will be zipped with their GPS metadata.` })}
          >
            <Download /> Export {filtered.length}
          </Button>
        }
      />

      {/* Site chips */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {[{ id: "all", name: "All sites", color: "var(--primary)" }, ...sites].map(s => {
          const active = site === s.id;
          const count = s.id === "all" ? photos.length : photos.filter(p => p.siteId === s.id).length;
          return (
            <motion.button
              key={s.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setSite(s.id)}
              className={cn(
                "relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors",
                active ? "border-transparent text-white" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="site-chip"
                  className="absolute inset-0 rounded-xl shadow-glow"
                  style={{ backgroundColor: s.color }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {!active && <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />}
                {s.name}
                <span className={cn("rounded-md px-1.5 text-[11px] font-bold", active ? "bg-white/20" : "bg-muted")}>{count}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="surface mb-6 flex flex-col gap-3 rounded-2xl p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-80">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput placeholder="Search task or person" className="h-10 pl-10" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="h-10 rounded-xl" />}>
              {selectedPerson ? <PersonAvatar person={selectedPerson} size="xs" /> : <UserRound />}
              {selectedPerson ? selectedPerson.name : "Everyone"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Taken by</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={person} onValueChange={v => setPerson(String(v))}>
                  <DropdownMenuRadioItem value="all">Everyone</DropdownMenuRadioItem>
                  {photographers.map(c => (
                    <DropdownMenuRadioItem key={c.id} value={c.id}>
                      <PersonAvatar person={c} size="xs" /> {c.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <SegmentedControl
            value={media}
            onChange={setMedia}
            options={[
              { value: "all", label: "All" },
              { value: "photo", label: <ImageIcon className="size-4" aria-label="Photos" /> },
              { value: "video", label: <Film className="size-4" aria-label="Videos" /> },
            ]}
          />
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={[
              { value: "today", label: "Today" },
              { value: "7d", label: "7 days" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Images className="size-4 text-primary" /> <b className="text-foreground">{filtered.length}</b> captures
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-4 text-primary" /> <b className="text-foreground">{contributors}</b> people
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Crosshair className="size-4 text-success" /> <b className="text-foreground">{Math.round(precise * 100)}%</b> precise GPS (±20 m)
        </span>
        <AnimatePresence>
          {hasFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              type="button"
              onClick={() => {
                setSite("all");
                setPerson("all");
                setMedia("all");
                setQuery("");
              }}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent"
            >
              <X className="size-3.5" /> Clear filters
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<Images className="size-6" />} title="No photos match" description="Try widening the date range or clearing filters." />
      ) : (
        <div className="space-y-8">
          {groups.map(([day, items]) => (
            <section key={day}>
              <div className="sticky top-[72px] z-10 -mx-2 mb-3 flex items-center gap-3 bg-background/85 px-2 py-2 backdrop-blur">
                <h2 className="text-base font-extrabold">{dayLabel(day)}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{items.length}</span>
                <span className="h-px flex-1 bg-border" />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
                  onClick={() => toast.success(`Day report queued`, { description: `${items.length} photos from ${dayLabel(day)} → PDF.` })}
                >
                  <Check className="size-3.5" /> Day report
                </button>
              </div>
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5 [&>*]:mb-3">
                {items.map((p, i) => (
                  <PhotoThumb
                    key={p.id}
                    photo={p}
                    index={i}
                    onOpen={ph => setOpenId(ph.id)}
                    className={p.height > p.width ? "aspect-[3/4]" : "aspect-[4/3]"}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Lightbox photos={filtered} openId={openId} onClose={() => setOpenId(null)} onChange={setOpenId} />
    </>
  );
}
