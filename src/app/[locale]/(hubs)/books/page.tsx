import { HUB_PAGE_REVALIDATE, createHubPage } from "../hub-page-factory";

const hub = createHubPage("books");

export const revalidate = HUB_PAGE_REVALIDATE;
export const generateMetadata = hub.generateMetadata;
export default hub.Page;
