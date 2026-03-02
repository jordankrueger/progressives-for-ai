const LISTMONK_ORIGIN = "https://newsletter.campaign.help";

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  // Map /archive/... to the ListMonk archive path
  const targetUrl = LISTMONK_ORIGIN + url.pathname + url.search;

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": request.headers.get("User-Agent") || "",
      "Accept": request.headers.get("Accept") || "",
    },
  });

  const contentType = response.headers.get("content-type") || "";

  // For HTML responses, rewrite relative paths so CSS/images load from ListMonk
  if (contentType.includes("text/html")) {
    let html = await response.text();
    // Rewrite relative paths to absolute ListMonk URLs
    html = html.replace(/href="\/(public|uploads)\//g, `href="${LISTMONK_ORIGIN}/$1/`);
    html = html.replace(/src="\/(public|uploads)\//g, `src="${LISTMONK_ORIGIN}/$1/`);
    // Rewrite archive links to stay on this domain
    html = html.replace(
      new RegExp(`href="${LISTMONK_ORIGIN}/archive`, "g"),
      'href="/archive'
    );
    // Rewrite RSS feed link to use this domain
    html = html.replace(
      `href="${LISTMONK_ORIGIN}/archive.xml"`,
      'href="/archive.xml"'
    );
    // Rewrite subscription form link
    html = html.replace(
      `href="${LISTMONK_ORIGIN}/subscription/form"`,
      'href="/"'
    );

    return new Response(html, {
      status: response.status,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=300",
      },
    });
  }

  // Pass through non-HTML responses (RSS XML, etc.) as-is
  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=300",
    },
  });
};
