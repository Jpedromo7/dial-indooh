"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ListVideo, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function PlaylistsPage() {
  const { toast } = useToast();
  const query = useApiQuery(apiClient.listPlaylists, []);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const playlists = query.data ?? [];

  async function createPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);

    try {
      await apiClient.createPlaylist({ name, description: description || null, isActive: true });
      toast({ title: "Playlist created", description: name, variant: "success" });
      setName("");
      setDescription("");
      await query.refresh();
    } catch (error) {
      toast({ title: "Create failed", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function updatePlaylist(id: string, input: { name?: string; description?: string | null; isActive?: boolean }) {
    try {
      await apiClient.updatePlaylist(id, input);
      toast({ title: "Playlist updated", variant: "success" });
      setEditingId(null);
      await query.refresh();
    } catch (error) {
      toast({ title: "Update failed", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader>
            <CardTitle>Create playlist</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createPlaylist}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Lobby loop"
                required
                value={name}
              />
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setDescription(event.currentTarget.value)}
                placeholder="Description"
                value={description}
              />
              <Button className="w-full" disabled={isCreating} type="submit">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {isCreating ? "Creating..." : "Create playlist"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {query.error ? (
          <ErrorBanner message={query.error} />
        ) : query.isLoading ? (
          <LoadingSkeleton className="h-96" />
        ) : playlists.length === 0 ? (
          <EmptyState icon={ListVideo} title="No playlists yet" description="Create a playlist to start building screen loops." />
        ) : (
          <div className="grid gap-4">
            {playlists.map((playlist) => {
              const isEditing = editingId === playlist.id;

              return (
                <Card className="bg-card/70" key={playlist.id}>
                  <CardContent className="p-5">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        {isEditing ? (
                          <EditPlaylistForm
                            defaultDescription={playlist.description ?? ""}
                            defaultName={playlist.name}
                            onCancel={() => setEditingId(null)}
                            onSave={(input) => updatePlaylist(playlist.id, input)}
                          />
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-3">
                              <h2 className="text-lg font-semibold">{playlist.name}</h2>
                              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                                {playlist.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{playlist.description ?? "No description"}</p>
                            <p className="mt-3 text-xs text-muted-foreground">
                              {playlist.items.length} items · Updated {formatDate(playlist.updatedAt)}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button asChild type="button" variant="secondary">
                          <Link href={`/playlists/${playlist.id}`}>Open</Link>
                        </Button>
                        <Button onClick={() => setEditingId(playlist.id)} type="button" variant="ghost">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => updatePlaylist(playlist.id, { isActive: !playlist.isActive })}
                          type="button"
                          variant="ghost"
                        >
                          {playlist.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          {playlist.isActive ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EditPlaylistForm({
  defaultName,
  defaultDescription,
  onCancel,
  onSave
}: {
  defaultName: string;
  defaultDescription: string;
  onCancel: () => void;
  onSave: (input: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, description: description || null });
      }}
    >
      <input
        className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setName(event.currentTarget.value)}
        value={name}
      />
      <textarea
        className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setDescription(event.currentTarget.value)}
        value={description}
      />
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
