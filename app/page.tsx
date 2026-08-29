import { BLOCK_CENTROIDS } from "../data/seed";
import { HomeView } from "./home-view";

export default function Home() {
  return <HomeView blocks={BLOCK_CENTROIDS} />;
}
