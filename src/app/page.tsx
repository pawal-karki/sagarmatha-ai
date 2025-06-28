import { getQueryClient, trpc } from "@/trpc/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Client } from "./api/trpc/[trpc]/client";
import { Suspense } from "react";

const Page = async () => {
  const queryClient = getQueryClient();
  //prefetch the query what is does is it will fetch the data from the server and store it in the query client
  void queryClient.prefetchQuery(
    trpc.sagarmathaAPI.queryOptions({ text: "Hello Prefetch" })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<p>Loading...</p>}>
        <Client />
      </Suspense>
    </HydrationBoundary>
  );
};

export default Page;
