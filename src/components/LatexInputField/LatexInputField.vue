<template>
  <div class="latex-editor">
    <!-- Eingabebereich mit Quasar QInput -->
    <q-input
      v-if="isEditing"
      v-model="value"
      type="text"
      dense
      outlined
      :placeholder="dynamicPlaceholder"
      label=""
      class="editor"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
      @update:model-value="onUserInput"
    >
      <!-- Vorschau im Label-Bereich -->
      <template v-slot:label>
        <span v-html="renderedLatexLabel"></span>
      </template>
    </q-input>

    <!-- Vorschau ohne Bearbeitung -->
    <q-input
      v-else
      v-model="value"
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
import type { Ref } from "vue";
import { QInput } from "quasar";
import { LatexInputFieldComponent } from "src/components/LatexInputField/LatexInputField";
import type { LatexInputFieldProps } from "src/components/LatexInputField/LatexInputField";
import katex from "katex";
import "katex/dist/katex.min.css";

// Props aus der CARPET Component Library definieren
const props = defineProps<LatexInputFieldProps>();
const { storeObject, componentID, componentPath } = toRefs(props);

// LatexInputFieldComponent-Instanz erstellen
const component = new LatexInputFieldComponent(
  storeObject,
  unref(componentID),
  unref(componentPath),
);

// Aus dem Component-Objekt erhalten wir die Daten.
// Hier liegt z. B. fieldValue und ggf. andere Konfigurationen.
const componentData = component.getComponentData();
const dependencies = component.loadDependencies();

// Lokales Ref, das wir per v-model an den QInput binden
// und in das wir den Wert aus dem Store schreiben.
const value: Ref<(typeof componentData.value)["fieldValue"]> = ref(undefined);

// Reaktive Variablen
const isEditing = ref(false); // Steuert den Bearbeitungsmodus

// Computed für Syntaxfehler (Verwendung von getSyntaxError aus LatexInputField.ts)
const syntaxError = computed(() => component.getSyntaxError(value.value));

// Echtzeit-Rendering des LaTeX-Inhalts
const renderedLatexLabel = computed(() => {
  if (!value.value || value.value.trim() === "") {
    return "Hier Latex-Code eingeben";
  }
  return syntaxError.value === null
    ? katex.renderToString(value.value, { throwOnError: true })
    : "Ungültiger LaTeX-Code";
});

// Dynamischer Placeholder
const dynamicPlaceholder = computed(() => {
  return !value.value || value.value.trim() === "" ? "Hier Latex eingeben" : "";
});


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
  // Initialer Wert (genauso wie InputField.vue)
  // => erst referenceValue, falls gesetzt, sonst fieldValue
  value.value = dependencies.value.referenceValue ?? unref(componentData).fieldValue;
  component.validate(<string | undefined | null>value.value);

});

watch(
  () => componentData.value.fieldValue,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      value.value = newVal;
      component.validate(value.value);
    }
  }
);

const onUserInput = (newValue: string | number | null) => {
  // 1) Wert in den Store schreiben
  unref(storeObject).setProperty({
    path: `${component.getComponentPath()}.component.fieldValue`,
    value: newValue
  });

  // 2) Validierung
  component.validate(value.value);
};

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


