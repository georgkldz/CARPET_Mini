import type {
  SerializedBaseComponent,
  SerialisedDependencies,
  ComponentDependencies,
  ComponentProps,
  ComponentData,
  JSONPathExpression,
  ValidationConfiguration,
} from "carpet-component-library";
import { BaseComponent } from "carpet-component-library";
import { ref, unref } from "vue";
import type { QInputProps } from "quasar";


/**
 * The TextViewProps interface is used to define the properties, that are passed from the parent component to the TextView component.
 */
export declare interface TextViewProps extends ComponentProps {}
export interface TextViewProps extends ComponentProps {
  modelValue?: string; // Der LaTeX-Inhalt wird optional übergeben
}
/**
 * The type of the TextView component.
 */
export declare type TextViewComponentType = "TextView";

/**
 * The InputField-component may receive a path to a reference value for the initialization of the input field value.
 */
export interface SerializedTextViewDependencies
  extends SerialisedDependencies {
  referenceValue?: JSONPathExpression;
}

/**
 * The TextView-component may utilize a reference value for the initialization of the input field value.
 */
export interface TextViewDependencies extends ComponentDependencies {
  referenceValue?: string | undefined | null;
}

export interface FieldConfiguration extends Omit<QInputProps, "modelValue" | "inputStyle"> {
  placeholder?: string;
}

/**
 * The InputField-component may hold a static input field value in its componentData.
 */
export declare interface TextViewComponentData extends ComponentData {
  fieldConfiguration: FieldConfiguration;
  fieldValue: string | undefined | null;
}

/**
 * Configuration for basic comparison operations with static values.
 */
export declare interface ComparisonConfiguration {
}

/**
 * Validation strategy that compares static values to the value of the input field.
 */
export declare interface TextViewValidationConfiguration
  extends ValidationConfiguration {
  comparisons: Array<ComparisonConfiguration>;
}

/**
 * The SerializedTextViewComponent interface is used to define the serialised properties of the TextView component.
 */
export declare interface SerializedTextViewComponent
  extends SerializedBaseComponent<
    TextViewComponentType,
    SerializedTextViewDependencies,
    TextViewComponentData,
    TextViewValidationConfiguration
  > {}

/**
 * The InputFieldComponent class is a derived taskComponent, that allows users to enter textual or numeric input.
 */
export class TextViewComponent extends BaseComponent<
  SerializedTextViewComponent,
  SerializedTextViewDependencies,
  TextViewDependencies,
  TextViewComponentData,
  TextViewValidationConfiguration
> {
  /**
   * A InputFieldComponent is valid, if it matches the value in the InputFieldValidationConfiguration.
   * @returns
   */
  /**
   * Validate the LaTeX content entered by the user.
   * @param userValue The LaTeX content provided by the user.
   */
  public validate(textValue: string | undefined | null) {
    // Start: Angenommen, der Wert ist erst mal gültig
    const isValid = ref(true);

    // Prüfen, ob der Wert nicht erlaubt ist (undefined, null oder leerer String)
    if (textValue === undefined || textValue === null || textValue.trim() === "") {
      isValid.value = false;
    }

    // Über den Store (bzw. die storeObject-Referenz) setzen wir das Ergebnis
    unref(this.storeObject).setProperty({
      path: `${this.serialisedBaseComponentPath}.isValid`,
      value: isValid.value,
    });
  }




}

