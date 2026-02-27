import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: t("api.unauthorized") }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: t("api.addressNotConfigured") },
      { status: 500 }
    );
  }

  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", query);
    url.searchParams.set("filter", "countrycode:ca");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("apiKey", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    const results = (data.results || []).map((r: {
      address_line1?: string;
      street?: string;
      housenumber?: string;
      city?: string;
      state_code?: string;
      postcode?: string;
      formatted?: string;
    }) => ({
      streetAddress: r.address_line1 || [r.housenumber, r.street].filter(Boolean).join(" ") || "",
      city: r.city || "",
      province: r.state_code || "QC",
      postalCode: r.postcode || "",
      formatted: r.formatted || "",
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: t("api.addressFetchFailed") },
      { status: 500 }
    );
  }
}
