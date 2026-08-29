import { BLOCK_CENTROIDS } from "../data/seed";
import { cookies } from "next/headers";
import { isLanguage } from "../lib/i18n";
import { HomeView } from "./home-view";

export default async function Home() {
  const cookieLanguage = (await cookies()).get("thikhua-language")?.value;
  const language = isLanguage(cookieLanguage) ? cookieLanguage : "en";

  return <HomeView blocks={BLOCK_CENTROIDS} language={language} />;
}
