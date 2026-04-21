"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { PlaylistDto, PlaylistItemDto } from "@dialindooh/shared";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { PlaylistItemRow } from "@/components/admin/playlist-item-row";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDuration } from "@/lib/format";

export default function PlaylistDetailsPage() {
  const params = useParams<{ id: string }>();
  const playlistId = params.id;
  const { toast } = useToast();
  const playlistQuery = useApiQuery(() => apiClient.getPlaylist(playlistId), [playlistId]);
  const mediaQuery = useApiQuery(apiClient.listMedia, []);
  const [items, setItems] = useState<PlaylistItemDto[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [displayDurationSeconds, setDisplayDurationSeconds] = useState("10");
  const [removeTarget, setRemoveTarget] = useState<PlaylistItemDto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const playlist = playlistQuery.data;
  const media = mediaQuery.data ?? [];
  const readyMedia = useMemo(() => media.filter((item) => item.status === "ready"), [media]);
  const selectedMedia = useMemo(() => readyMedia.find((item) => item.id === selectedMediaId), [readyMedia, selectedMediaId]);

  useEffect(() => {
    setItems(playlist?.items ?? []);
  }, [playlist]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMedia) {
      return;
    }

    setIsSaving(true);

    try {
      const updatedPlaylist = await apiClient.addPlaylistItem(playlistId, {
        mediaId: selectedMedia.id,
        displayDurationSeconds: selectedMedia.type === "image" ? Number(displayDurationSeconds || 10) : null
      });
      applyPlaylist(updatedPlaylist);
      setSelectedMediaId("");
      toast({ title: "Item added", description: selectedMedia.title, variant: "success" });
    } catch (error) {
      toast({ title: "Could not add item", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    setIsSaving(true);

    try {
      const updatedPlaylist = await apiClient.deletePlaylistItem(playlistId, itemId);
      applyPlaylist(updatedPlaylist);
      toast({ title: "Item removed", variant: "success" });
    } catch (error) {
      toast({ title: "Remove failed", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function updateDuration(itemId: string, duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) {
      toast({ title: "Invalid duration", description: "Use a positive number of seconds.", variant: "error" });
      return;
    }

    try {
      const updatedPlaylist = await apiClient.updatePlaylistItem(playlistId, itemId, {
        displayDurationSeconds: duration
      });
      applyPlaylist(updatedPlaylist);
      toast({ title: "Duration saved", variant: "success" });
    } catch (error) {
      toast({ title: "Duration failed", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function saveReorder() {
    setIsSaving(true);

    try {
      const updatedPlaylist = await apiClient.reorderPlaylistItems(
        playlistId,
        items.map((item, index) => ({ id: item.id, order: index + 1 }))
      );
      applyPlaylist(updatedPlaylist);
      toast({ title: "Order saved", variant: "success" });
    } catch (error) {
      toast({ title: "Reorder failed", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  function applyPlaylist(updatedPlaylist: PlaylistDto) {
    playlistQuery.setData(updatedPlaylist);
    setItems(updatedPlaylist.items);
  }

  function moveItem(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      return;
    }

    setItems((current) => {
      const next = [...current];
      const [movedItem] = next.splice(dragIndex, 1);

      if (!movedItem) {
        return current;
      }

      next.splice(dropIndex, 0, movedItem);
      return next.map((item, index) => ({ ...item, order: index + 1 }));
    });
    setDragIndex(null);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Button asChild type="button" variant="ghost">
          <Link href="/playlists">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to playlists
          </Link>
        </Button>

        {playlistQuery.error || mediaQuery.error ? (
          <ErrorBanner message={playlistQuery.error ?? mediaQuery.error ?? "Unable to load playlist."} />
        ) : playlistQuery.isLoading ? (
          <LoadingSkeleton className="h-96" />
        ) : playlist ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
            <div className="space-y-4">
              <div className="rounded-lg border bg-card/70 p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <h2 className="text-2xl font-semibold">{playlist.name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{playlist.description ?? "No description"}</p>
                  </div>
                  <Button disabled={isSaving || items.length === 0} onClick={saveReorder} type="button">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {isSaving ? "Saving..." : "Save order"}
                  </Button>
                </div>
              </div>

              {items.length === 0 ? (
                <EmptyState icon={Plus} title="No playlist items" description="Add media to start building this playback loop." />
              ) : (
                <div className="grid gap-3">
                  {items.map((item, index) => (
                    <PlaylistItemRow
                      index={index}
                      isSaving={isSaving}
                      item={item}
                      key={item.id}
                      onDragStart={setDragIndex}
                      onDrop={moveItem}
                      onDurationChange={updateDuration}
                      onRemove={() => setRemoveTarget(item)}
                    />
                  ))}
                </div>
              )}
            </div>

            <Card className="h-fit bg-card/70">
              <CardHeader>
                <CardTitle>Add media</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={addItem}>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    onChange={(event) => setSelectedMediaId(event.currentTarget.value)}
                    required
                    value={selectedMediaId}
                  >
                    <option value="">Choose media</option>
                    {readyMedia.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.type})
                      </option>
                    ))}
                  </select>
                  {readyMedia.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No ready media available for playlists.</p>
                  ) : null}
                  {selectedMedia?.type === "image" ? (
                    <label className="block space-y-2 text-sm font-medium">
                      <span>Display seconds</span>
                      <input
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        min={1}
                        onChange={(event) => setDisplayDurationSeconds(event.currentTarget.value)}
                        type="number"
                        value={displayDurationSeconds}
                      />
                    </label>
                  ) : null}
                  {selectedMedia?.type === "video" ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                      Video duration: {formatDuration(selectedMedia.durationSeconds)}. The TV player will play the full
                      video, then continue the loop.
                    </div>
                  ) : null}
                  <Button className="w-full" disabled={isSaving || mediaQuery.isLoading} type="submit">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add to playlist
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <EmptyState icon={Plus} title="Playlist not found" description="The requested playlist could not be loaded." />
        )}
      </div>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove playlist item?"
        description="This item will be removed from the playlist order."
        confirmLabel="Remove"
        isLoading={isSaving}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (removeTarget) {
            await removeItem(removeTarget.id);
            setRemoveTarget(null);
          }
        }}
      />
    </AppShell>
  );
}
