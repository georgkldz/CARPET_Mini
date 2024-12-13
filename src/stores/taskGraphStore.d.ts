import "pinia";
import { TaskGraphState } from "./taskGraphStore"; // Typ des State importieren

declare module "pinia" {
  export interface PiniaCustomProperties {
    $state: TaskGraphState; // Typisiere $state für alle Stores
  }
}
