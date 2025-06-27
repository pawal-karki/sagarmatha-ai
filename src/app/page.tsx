import { Button } from "@/components/ui/button";
import prisma from "@/lib/dbConnection";

const Home = async () => {
  const users = await prisma.user.findMany();
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {JSON.stringify(users)}
    </div>
  );
};

export default Home;
