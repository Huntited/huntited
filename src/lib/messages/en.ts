// Interface texts in English. Same keys as fr.ts (enforced by the type).
import type { Messages } from "./fr";

export const en: Messages = {
  // Header and navigation
  "nav.hunts": "Hunts",
  "nav.create": "Create",
  "nav.myHunts": "My hunts",
  "nav.pass": "My pass",
  "nav.menu": "Menu",
  "nav.home": "Huntited home",
  "lang.switch": "Language",
  "wallet.connect": "Connect wallet",
  "wallet.connecting": "Connecting…",
  "wallet.disconnect": "Disconnect",
  "footer.tagline": "Everyone or no one. No personal data.",
  "footer.testnet": "Test version: no real KAS.",
  "dev.reset": "Reset demo data",
  "dev.resetConfirm": "Reset Huntited demo data?",

  // Error pages
  "notFound.title": "This page doesn't exist",
  "notFound.text": "The link may be incomplete, or the hunt has been removed.",
  "notFound.home": "See hunts",
  "notFound.create": "Create a hunt",
  "error.title": "This page couldn't load",
  "error.text":
    "Something went wrong on our side. Try again, or go back home. Nothing was sent or committed.",
  "error.retry": "Try again",
  "error.home": "Back to home",
  "common.back": "← Back",
  "common.loading": "Loading…",

  // Hunt statuses
  "status.draft": "Draft",
  "status.active": "Ongoing",
  "status.activated": "Threshold reached",
  "status.expired": "Expired",
  "status.settled": "Settled",
  "status.aria": "Status: {label}",

  // Home
  "home.title": "Act together, never alone",
  "home.lead":
    "Everyone commits privately. The action only happens if enough people join; otherwise, everyone gets their deposit back.",
  "home.step1.title": "A hunt",
  "home.step1.text": "An action, a place, a deadline and a minimum number of people.",
  "home.step2.title": "Private commitments",
  "home.step2.text": "Everyone commits without showing up: nobody takes a risk alone.",
  "home.step3.title": "Everyone or no one",
  "home.step3.text":
    "Threshold reached: the action happens. Otherwise, everyone gets their deposit back.",
  "home.create": "Create a hunt",
  "home.search": "Search hunts…",
  "home.filter": "Filter by status",
  "home.filter.all": "All",
  "home.filter.active": "Ongoing",
  "home.filter.activated": "Triggered",
  "home.filter.expired": "Ended",
  "home.section.all": "All hunts",
  "home.section.active": "Ongoing hunts",
  "home.section.activated": "Triggered hunts",
  "home.section.expired": "Ended hunts",
  "home.section.results": "Results",
  "home.loadError": "Hunts can't be loaded right now. Please try again later.",
  "home.noMatch": "No hunt matches these filters.",
  "home.empty": "No hunts yet. Start the first one!",
  "home.card.before": "before {date}",
  "home.card.progress": "{count} of {threshold} committed",
  "home.card.hidden": "Threshold: {threshold} · progress hidden",
};
