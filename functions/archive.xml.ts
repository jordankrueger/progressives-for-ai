const LISTMONK_ORIGIN = "https://newsletter.campaign.help";

export const onRequest: PagesFunction = async ({ request }) => {
  const response = await fetch(`${LISTMONK_ORIGIN}/archive.xml`, {
    headers: {
      "User-Agent": request.headers.get("User-Agent") || "",
      "Accept": request.headers.get("Accept") || "",
    },
  });

  let xml = await response.text();
  // Rewrite ListMonk archive links to stay on this domain
  xml = xml.replace(
    new RegExp(`${LISTMONK_ORIGIN}/archive`, "g"),
    "https://progressivesforai.com/archive"
  );
  // Rewrite the channel link
  xml = xml.replace(
    `<link>${LISTMONK_ORIGIN}</link>`,
    "<link>https://progressivesforai.com</link>"
  );

  return new Response(xml, {
    status: response.status,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};
