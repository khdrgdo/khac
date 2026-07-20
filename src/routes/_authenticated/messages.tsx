import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { MessagesShell } from "@/components/MessagesShell";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const activeId = params?.id;

  return (
    <MessagesShell activeId={activeId}>
      <Outlet />
    </MessagesShell>
  );
}
