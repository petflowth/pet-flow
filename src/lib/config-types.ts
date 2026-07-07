import type { RoomType } from "./business";

export type LocalizedLines = { th: string[]; en: string[] };

export type PointsRewardConfig = {
  id: string;
  points: number;
  reward: { th: string; en: string };
};

export type GroomingConfig = {
  menus: Record<string, unknown>;
  specials: { th: { name: string; price: string }[]; en: { name: string; price: string }[] };
  notes: LocalizedLines;
  sizeLabels: { th: Record<string, string>; en: Record<string, string> };
};

export type SiteConfig = {
  version: number;
  updatedAt: string;
  business: {
    name: string;
    tagline: { th: string; en: string };
    lineOa: string;
    phones: string[];
    maps: string;
    facebook: string;
    location: { th: string; en: string };
    pointsRate: number;
  };
  payment: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  roomInventory: {
    total: number;
    miniMeow: number;
    midCozy: number;
    catflix: number;
  };
  rooms: RoomType[];
  groomSlots: string[];
  transport: LocalizedLines;
  pointsRewards: PointsRewardConfig[];
  grooming: GroomingConfig;
};
