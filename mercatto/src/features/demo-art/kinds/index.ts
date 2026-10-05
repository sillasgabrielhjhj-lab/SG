import type { DemoArtKind } from "../catalog";
import { drawAirfryer, drawBlender, drawCoffeemaker, drawMicrowave, drawRefrigerator, drawRobotVacuum, drawWasher } from "./appliances";
import { drawEarbuds, drawHeadphones, drawSoundbar, drawSpeaker } from "./audio";
import { drawDashcam, drawDrill, drawTire, drawToolbox } from "./auto-tools";
import { drawHairdryer, drawPerfume, drawSkincare } from "./beauty";
import { drawLaptop, drawMonitor, drawSmartphone, drawSmartwatch, drawTablet, drawTv } from "./devices";
import { drawBackpack, drawSneaker, drawSunglasses, drawTshirt, drawWristwatch } from "./fashion";
import { drawCookware, drawLamp, drawOfficeChair, drawSofa } from "./home";
import { drawConsole, drawController, drawHeadset, drawKeyboard, drawMouse } from "./peripherals";
import { drawBicycle, drawDumbbell, drawFootball, drawYogaMat } from "./sports";
import type { DrawKind } from "./types";

export type { DrawKind } from "./types";

/** Um desenhista por tipo de produto — o `Record` garante cobertura total. */
export const KIND_DRAWERS: Readonly<Record<DemoArtKind, DrawKind>> = {
  smartphone: drawSmartphone,
  smartwatch: drawSmartwatch,
  earbuds: drawEarbuds,
  laptop: drawLaptop,
  monitor: drawMonitor,
  keyboard: drawKeyboard,
  mouse: drawMouse,
  tablet: drawTablet,
  console: drawConsole,
  controller: drawController,
  headset: drawHeadset,
  tv: drawTv,
  soundbar: drawSoundbar,
  speaker: drawSpeaker,
  headphones: drawHeadphones,
  refrigerator: drawRefrigerator,
  washer: drawWasher,
  microwave: drawMicrowave,
  airfryer: drawAirfryer,
  blender: drawBlender,
  coffeemaker: drawCoffeemaker,
  "robot-vacuum": drawRobotVacuum,
  "office-chair": drawOfficeChair,
  lamp: drawLamp,
  cookware: drawCookware,
  sofa: drawSofa,
  tshirt: drawTshirt,
  sneaker: drawSneaker,
  backpack: drawBackpack,
  wristwatch: drawWristwatch,
  sunglasses: drawSunglasses,
  perfume: drawPerfume,
  skincare: drawSkincare,
  hairdryer: drawHairdryer,
  tire: drawTire,
  dashcam: drawDashcam,
  drill: drawDrill,
  toolbox: drawToolbox,
  bicycle: drawBicycle,
  dumbbell: drawDumbbell,
  "yoga-mat": drawYogaMat,
  football: drawFootball,
};
