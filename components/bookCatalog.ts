// Shared book display data — the single source for the creator page
// panels AND the home-view creator section's book modals. (The server
// catalog in lib/books.ts is separate: prices, files, fulfillment.)
export const BOOKS = [
  {
    slug: "the-ground-you-stand-on",
    title: "The Ground We Stand On",
    cover: "/book-covers/ground-we-stand-on.jpg",
    pages: "62-page PDF",
    lead: "Twenty years. No address. Every lesson learned the hard way.",
    body: [
      "When Kyle Jacob Butler lost his home, nobody handed him a manual. There wasn't one. So he learned the street the only way it teaches — night by night, winter by winter — for twenty years. The Ground We Stand On is the book he wishes someone had given him on his first night outside.",
      "This is not theory, and it is not charity literature. It is a working survival manual written by a man who has slept behind billboards and in abandoned houses, who has kept warm with a coffee-can heater of his own making, and who came out the other side with his word, his habits, and his dignity intact.",
    ],
    points: [
      "Travel Light — why everything you own should fit on your back, and the decoy-backpack trick that can save your real gear",
      "The Cardboard Sign — how to ask strangers for help without losing yourself",
      "Sleep Hidden — hammocks, billboards, empty buildings, and the three rules of a spot nobody finds",
      "Keep Warm — three ways to build a heater from almost nothing, and the plastic-bag tricks that keep feet dry and bodies alive",
      "Don't Take Gifts — the rule that sounds cold and exists for a reason",
      "Plus: staying clean, foraging what grows around you, holding your tongue, and leaving every place cleaner than you found it",
    ],
    who: "For anyone facing homelessness or one paycheck away from it; anyone sleeping in a car tonight and wondering what comes next; families trying to understand what a loved one out there is living; and the outreach workers, shelter staff, librarians, and neighbors who meet people on the street every day.",
  },
  {
    slug: "the-trouble-with-english",
    title: "The Trouble with English",
    cover: "/book-covers/trouble-with-english.jpg",
    pages: "75-page PDF",
    lead: "Most arguments aren't disagreements. They're clerical errors.",
    body: [
      "Sit in on almost any fight — in a kitchen, a courtroom, or the comments under a news story — and listen carefully. Much of the time the two sides aren't actually disagreeing. They're using the same words to mean different things, then fighting about the echo.",
      "The Trouble with English walks through the traps, one by one — and closes with a Peace Treaty for English: seven articles, each distilled from a chapter, for fighting less about words and more about what's actually meant.",
    ],
    points: [
      "One Word, Many Meanings — why set and run need hundreds of definitions",
      "Letters That Lie — the lowercase l, capital I, and number 1 that look so alike whole security systems exist to keep them apart",
      "The Comma That Cost Millions — punctuation with a price tag",
      "Words That Changed Sides — when nice meant foolish and silly meant blessed",
      "The Machine Before Machines — the type mould that froze English spelling, and the Wicked Bible of 1631",
      "Loaded Words — death tax, tax relief, collateral damage: the verdict hidden inside the name",
      "Lost Between Languages — Rome's alphabet on loan to the world, the king who commissioned Hangul, and Sequoyah",
      "Machines Reading Us — autocorrect, the town blocked by its own name, and software that hears sarcasm as delight",
      "The Letter L — a right angle on the left, standing at the head of Left",
      "When Letters Count — Roman numerals: seven letters doing arithmetic with no zero and no place value",
    ],
    who: "Kyle Jacob Butler is not a linguist. He is something more useful for this subject: a man who has watched people argue, at length and with feeling, about words — and noticed how often the argument dissolved the moment somebody finally asked, wait, what do you mean by that? That question is the whole book.",
  },
  {
    slug: "dope-sick",
    title: "Dope Sick",
    cover: "/book-covers/dope-sick.jpg",
    pages: "88-page PDF",
    lead: "First he has to get well. Then he has to get hired. In that order, every day.",
    body: [
      "Dope Sick is Kyle Jacob Butler's journal of fentanyl addiction and homelessness, written one honest day at a time in a notebook he pulled from a church donation bin. It opens at 5 a.m. with the arithmetic every day begins with — a sick man cannot work, a working man cannot get sick straight — and it follows him to a McDonald's drive-thru, where he stands with a cardboard sign that says NEED WORK and waits for somebody to ask what he can do.",
      "People do ask. What they offer, and what he refuses, is the spine of the book: a contractor who counts a dead friend's hours as his own; a rescue that comes with a locked door; and a girl at the campfire whose kindness has a price nobody sees until it's collected. Through all of it he keeps his rules — never steal, never strong-arm, leave every sleeping spot cleaner than he found it — in a world that looks at him and sees scum.",
    ],
    points: [
      "5 A.M. — the order of operations: get well first, then work",
      "The Math — the rules a man keeps when keeping them costs him everything",
      "The Job on the North Side — six hours of work, and the pay refused in the driveway",
      "Counted Out — seven hours in a crawlspace, and a contractor who pays what he promised",
      "The Rescue — when help comes with a locked door, it isn't help",
      "Twenty Hours — billed for another man's work, and the witnesses who set it right",
      "The Wrong Line — for Robbie, who trusted a line to be what it was called",
      "Destiny — the girl whose offers nobody should ever accept twice",
    ],
    who: "For anyone who has ever wondered what the man with the sign is actually doing out there; for families with somebody inside the arithmetic, who want to understand its logic from the inside; and for anyone who believes a person's rules say more about him than his circumstances do. Dedicated to Robbie Winters, Aiden Schaefer, Steve Kallas, Beau Cravens, and Nick Walker — who should still be here.",
  },
] as const;

export type BookDisplay = (typeof BOOKS)[number];
