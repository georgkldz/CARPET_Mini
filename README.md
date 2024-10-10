# Nützliche Links für das Projekt
[Anforderungen der Kunden](https://catalpa-gitlab.fernuni-hagen.de/ks/fapra/fachpraktikum-2024/beta/CARPET/-/wikis/Kundengespr%C3%A4che)

[Projektmitglieder](https://catalpa-gitlab.fernuni-hagen.de/ks/fapra/fachpraktikum-2024/beta/CARPET/-/wikis/Kontaktdaten-und-%C3%BCbliche-Arbeitszeiten-der-Team-Mitglieder)


# CARPET

CARPET ("graphiCal Assessment inteRPreter and attemPtEd solution Tracker") is a framework to support technology-enhanced items (TEI), with specialized interactions for collecting response data. These include interactions and responses beyond traditional selected-response or constructed-response, which are usually implemented according to the [QTI standard](https://www.1edtech.org/standards/qti/index#QTI3).
QTI is restrictive in terms of the types of interactions that can be implemented, and it is not always easy to implement custom interactions. CARPET is designed to be more flexible and to support a wider range of interactions.
The flexibility comes at the cost of not being able to directly use QTI-compliant authoring tools. However, CARPET has its own lightweight domain specific language (DSL) for defining assessments. An overview can be found in the [CARPET documentation](https://aladin.htw-dresden.de/docs/chapters/CARPET/CARPET.html).
An overview of available items is given in the [carpet-component-library](https://htw-aladin.github.io/LOOM/?path=/docs/introduction--docs).

## For Developers

### Install the dependencies

```bash
yarn
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev
```

### Lint the files

```bash
yarn lint
```

### Format the files

```bash
yarn format
```

### Build the app for production

```bash
quasar build
```
