import { createHubPage } from "../hub-page-factory";

const hub = createHubPage("books");

export const revalidate = 3600;
export const generateMetadata = hub.generateMetadata;
export default hub.Page;
