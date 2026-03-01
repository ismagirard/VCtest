import { MaxiAdapter } from "./maxi.js";

// ── Provigo Adapter ──
//
// Same Loblaw PC Express API as Maxi, different banner and store ID.
// Provigo stores are higher-end with different pricing and product selection.

export class ProvigoAdapter extends MaxiAdapter {
  readonly chainSlug = "provigo";
  readonly chainNameFr = "Provigo";
  readonly chainNameEn = "Provigo";
  readonly parentGroup = "loblaw";
  readonly website = "https://www.provigo.ca";

  protected banner = "provigo";
  protected storeId = "1506"; // Provigo store in Quebec
  protected origin = "https://www.provigo.ca";
}
