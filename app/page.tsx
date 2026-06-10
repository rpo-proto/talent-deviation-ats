import { TalentDashboard } from "./components/TalentDashboard";
import { getDashboardData } from "./lib/data";

export default function Home() {
  const data = getDashboardData();
  return <TalentDashboard data={data} />;
}
