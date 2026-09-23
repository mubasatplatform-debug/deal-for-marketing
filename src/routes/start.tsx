import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/start")({ component: StartLayout });

function StartLayout() {
  return <Outlet />;
}
