import { createFileRoute } from "@tanstack/react-router";
import { MessagesShell } from "@/components/MessagesShell";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  return <MessagesShell />;
}
