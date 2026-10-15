import { createServerFn } from "@tanstack/react-start";

import { getProjectName } from "./prds/project.server";

/** The project Loop was started in, for the top bar. Only its folder name is sent. */
export const getProject = createServerFn({ method: "GET" }).handler(() => ({
  name: getProjectName(),
}));
