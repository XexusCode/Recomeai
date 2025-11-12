import { HUB_PAGE_REVALIDATE, createHubPage } from "../hub-page-factory";

const hub = createHubPage("movies");

export const revalidate = HUB_PAGE_REVALIDATE;
export const generateMetadata = hub.generateMetadata;
export default hub.Page;
