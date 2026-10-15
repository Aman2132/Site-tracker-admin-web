"use client";

import { useIsSuperadmin } from "@/components/auth/AuthProvider";
import { StorageCleanupPanel } from "@/components/domain/StorageCleanupPanel";
import { StorageUsagePanel } from "@/components/domain/StorageUsagePanel";
import { PageHeader } from "@/components/domain/PageHeader";
import { Panel } from "@/components/domain/Panel";

/** How much of the free storage allowances the project uses. The sidebar meter links here. */
export function StorageView() {
  const isSuperadmin = useIsSuperadmin();
  return (
    <>
      <PageHeader
        title="Storage"
        description="How full the free allowances are: Firestore, the live-position database and the photo files."
      />
      <div className="max-w-3xl space-y-5">
        <Panel>
          <StorageUsagePanel />
        </Panel>
        {isSuperadmin && (
          <Panel title="Clean up storage" description="Delete old data in bulk to free space. Superadmin only.">
            <StorageCleanupPanel />
          </Panel>
        )}
      </div>
    </>
  );
}
