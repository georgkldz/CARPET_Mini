import BasicInputField from "src/components/BasicInputField/BasicInputField.vue";
import type { SerializedBasicInputFieldComponent } from "src/components/BasicInputField/BasicInputField";
import LatexInput from "components/LatexInput/LatexInput.vue";
import type { SerializedLatexInputComponent } from "components/LatexInput/LatexInput.ts";

export declare type SerializedCustomComponents =
  | SerializedBasicInputFieldComponent
  | SerializedLatexInputComponent;

export const CustomComponents = { BasicInputField, LatexInput };
