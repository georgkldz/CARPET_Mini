<template>
  <div class="latex-editor">
    <!-- Eingabebereich mit Quasar QInput -->
    <q-input
      v-if="isEditing"
      v-model="latexContent"
      type="text"
      dense
      outlined
      :placeholder="dynamicPlaceholder"
      label=""
      class="editor"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
      @input="onUserInput"
    >
      <!-- Vorschau im Label-Bereich -->
      <template v-slot:label>
        <span v-html="renderedLatexLabel"></span>
      </template>
    </q-input>

    <!-- Vorschau ohne Bearbeitung -->
    <q-input
      v-else
      v-model="latexContent"
      dense
      outlined
      readonly
      class="editor preview"
      @click="handleFocusIn"
    >
      <!-- Vorschau im Default-Bereich -->
      <template v-slot:default>
        <span v-html="renderedLatexLabel" class="latex-preview"></span>
      </template>
    </q-input>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, toRefs, unref } from "vue";
import { QInput } from "quasar";
import { LatexInputFieldComponent } from "src/components/LatexInputField/LatexInputField";
import type { LatexInputFieldProps } from "src/components/LatexInputField/LatexInputField";
import katex from "katex";
import "katex/dist/katex.min.css";

// Props aus der CARPET Component Library definieren
const props = defineProps<LatexInputFieldProps>();
const { storeObject, componentID, componentPath, modelValue } = toRefs(props);

// LatexInputFieldComponent-Instanz erstellen
const component = new LatexInputFieldComponent(
  storeObject,
  unref(componentID),
  unref(componentPath),
);

// Reaktive Variablen
const latexContent = ref<string>(modelValue.value || ""); // Lokaler Inhalt
const isEditing = ref(false); // Steuert den Bearbeitungsmodus

// Computed für Syntaxfehler (Verwendung von getSyntaxError aus LatexInputField.ts)
const syntaxError = computed(() => component.getSyntaxError(latexContent.value));

// Echtzeit-Rendering des LaTeX-Inhalts
const renderedLatexLabel = computed(() => {
  if (latexContent.value.trim() === "") {
    return "Hier Latex-Code eingeben";
  }
  return syntaxError.value === null
    ? katex.renderToString(latexContent.value || "", { throwOnError: true })
    : "Ungültiger LaTeX-Code";
});

// Dynamischer Placeholder
const dynamicPlaceholder = computed(() => {
  return latexContent.value.trim() === "" ? "Hier Latex eingeben" : "";
});

// Benutzerinteraktionen
const onUserInput = () => {
  // Trigger Validierung und speichern im Store
  component.validate(latexContent.value);
  unref(storeObject).setProperty({
    path: `${component.getComponentPath()}.component.fieldValue`,
    value: latexContent.value,
  });
};

const handleFocusIn = () => {
  isEditing.value = true;
};

const handleFocusOut = (event: FocusEvent) => {
  if (syntaxError.value) {
    event.preventDefault(); // Verhindert das Verlassen bei Fehler
    return;
  }
  isEditing.value = false;
};

// Initialisierung und Synchronisierung
onMounted(() => {
  if (props.storeObject && props.storeObject.store) {
    console.log("Store Object Details:", props.storeObject);
    props.storeObject.store.joinSession();
  } else {
    console.error("Store or storeObject is undefined", props.storeObject);
  }
  latexContent.value = modelValue.value || "";
  component.validate(latexContent.value); // Initiale Validierung

  // Synchronisierung mit dem Store
  watch(latexContent, (newValue) => {
    component.validate(newValue);
    unref(storeObject).setProperty({
      path: `${component.getComponentPath()}.component.fieldValue`,
      value: newValue,
    });
  });
});

// Beobachten von externen Änderungen an modelValue
watch(modelValue, (newValue) => {
  if (newValue !== latexContent.value) {
    latexContent.value = newValue || "";
  }
});
</script>

<style scoped>
.latex-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 800px;
  margin: 0 auto;
}

.editor {
  height: 40px;
  line-height: 40px;
  padding: 0;
}

/* Spezifische Stile für die Vorschau im Default-Slot */
.preview .latex-preview {
  white-space: nowrap; /* Verhindert Zeilenumbrüche */
  overflow: hidden; /* Versteckt überflüssigen Inhalt */
  text-overflow: ellipsis; /* Zeigt "..." für abgeschnittenen Text */
  display: block; /* Sicherstellen, dass der Inhalt als Block dargestellt wird */
  width: 100%; /* Maximale Breite nutzen */
}
</style>

