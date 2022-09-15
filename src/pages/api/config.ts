import { getRepository, User } from "../../entities";
import { NextApiRequest, NextApiResponse } from "next";

// TOREAD this internal route handler uses the optional arguments to the init
// call to set up logic that will respond regardless of method; contrast this
// with ./listings/[listingId].ts where the route handler only responds to GET
// calls
export default async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  req.log.info("Displaying computed configuration");
  const repo = getRepository(User);
  req.log.debug(await repo.findAll());
  res.status(200).json({
    request: {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.body,
    },
    config: process.env,
  });
};
