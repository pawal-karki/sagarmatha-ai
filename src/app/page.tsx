"use client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

const Page = () => {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.sagarmathaAPI.queryOptions({ text: "world" }));
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {JSON.stringify(data)}
    </div>
  );
};

export default Page;
