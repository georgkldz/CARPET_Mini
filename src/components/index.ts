import BasicInputField from "src/components/BasicInputField/BasicInputField.vue";
import type { SerializedBasicInputFieldComponent } from "src/components/BasicInputField/BasicInputField";
import LatexInput from "components/LatexInput/LatexInput.vue";
import type { SerializedLatexInputComponent } from "components/LatexInput/LatexInput.ts";
import LatexInputField from "components/LatexInputField/LatexInputField.vue";
import type {SerializedLatexInputFieldComponent} from "src/components/LatexInputField/LatexInputField";
import TextView from "./TextView/TextView.vue";
import type {SerializedTextViewComponent} from "components/TextView/TextView.ts";

export declare type SerializedCustomComponents =
  | SerializedBasicInputFieldComponent
  | SerializedLatexInputComponent
  | SerializedLatexInputFieldComponent
  | SerializedTextViewComponent;

export const CustomComponents = { BasicInputField, LatexInput, LatexInputField, TextView };
