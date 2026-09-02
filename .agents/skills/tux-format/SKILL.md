---
name: tux-format
description: >-
  Expert guide, DTD V5 grammar, XML schema rules, and validation specs for Troux
  Upload XML (TUX) payloads in Planview Enterprise One / Troux data collection.
  Use when creating, validating, analyzing, or troubleshooting TUX XML files,
  handling component/relationship aliases, parentalias hierarchies, locators,
  or defaultaction processing.
---

# Troux Upload XML (TUX) Format & Validation Skill

This skill equips the agent with complete, authoritative expertise on the **Troux Upload XML (TUX)** format (Document Type Definition Version 5) for Planview Enterprise One (Troux).

---

## 1. Quick Reference & Core Rules

1. **Root Element (`<trouxupload defaultaction="...">`):**
   * Global `defaultaction` scope (`update_or_create` [default], `update`, `create`, `find`, `delete`) applies across the entire payload to components and relationships.
   * Can be overridden at the record level using the `action` attribute on individual `<component>` or `<relationship>` tags.
   * Set `version="5"` for DTD V5 compliance.

2. **Intra-File Alias System (`XML ID` / `IDREF`):**
   * The `alias` attribute on `<component>` serves as the unique primary key (`XML ID`) for entity records within the payload file. **All `alias` values MUST be globally unique across the file**.
   * If an XML tag omits `alias`, automated processing tools generate an auto-fallback alias (`Type:Name` or `Type:Name:Index`).
   * `<comp1alias>`, `<comp2alias>`, and `<parentalias>` use `IDREF` to bind strictly by `alias`, **never by display name**.

3. **Parent Alias & Hierarchy Rules (`<parentalias>`):**
   * **Top-level / Root Components:** Omit `<parentalias>`.
   * **Sub-Components / Children:** Include `<parentalias alias="ParentAlias"/>` (`IDREF`).
   * **Rule of Thumb:** Use `<parentalias>` for **fixed, static part-of breakdown hierarchies** (e.g. `Country` $\rightarrow$ `State` $\rightarrow$ `City` $\rightarrow$ `Building`). Use explicit `<relationship>` tags for **dynamic or fluid connections** (e.g. `Server deploys Software Module`, `Manager supervises Worker`).

4. **Property Content Modes (`<property>`):**
   * **Scalar Text:** `<property name="PropName"><![CDATA[Value]]></property>` or `value="..."`.
   * **Multi-Valued Lists (`<listItem>`):** Uses `<listItem>` elements; `action="replace"` (default) vs `action="append"`.
   * **Hyperlinks (`<linkURL>` & `<linkDescription>`):** Formats web links attached to repository objects.

5. **Record Reconciliation & Locators (`<locator>`):**
   * **Server-Level Configuration (Recommended Best Practice):** Configured centrally in Extract Job settings (`componentTypeLocators`) to decouple TUX generation logic from server reconciliation.
   * **Inline Payload Level:** Can be specified per record via `<locator class="...">`.
   * **Default Locator (`NameTypeParent`):** Matches by `Parent` + `Type` + `Name`. Fails when names are non-unique (e.g., multiple people named "John Smith").
   * **Property Locators (`PropertyTypeParent`):** Reconciles by `Parent` + `Type` + a unique attribute (`Employee ID`, `Asset Tag`).

---

## 2. Formal DTD V5 Element Grammar (`TrouxUpload.dtd`)

```dtd
<!ELEMENT trouxupload ((component | relationship)*)>
<!ATTLIST trouxupload
	defaultaction (update_or_create | update | find | create | delete) "update_or_create"
	version CDATA #IMPLIED
>

<!ELEMENT component (parentalias?, description?, locator?, (property | component)*)>
<!ATTLIST component
	action (update_or_create | update | find | create | delete) "update_or_create"
	name CDATA #REQUIRED
	type CDATA #REQUIRED
	description CDATA #IMPLIED
	alias ID #IMPLIED
	uuid CDATA #IMPLIED
	id CDATA #IMPLIED
	objectUuid CDATA #IMPLIED
>

<!ELEMENT description (#PCDATA)>
<!ELEMENT parentalias EMPTY>
<!ATTLIST parentalias alias IDREF #REQUIRED>

<!ELEMENT property (#PCDATA | (parentalias?, listItem*, linkURL?, linkDescription?))>
<!ATTLIST property
	name CDATA #REQUIRED
	value CDATA ""
	action (replace | append) "replace"
	reflect CDATA #IMPLIED
>

<!ELEMENT listItem ((#PCDATA | linkURL | linkDescription)*)>
<!ELEMENT linkURL (#PCDATA)>
<!ELEMENT linkDescription (#PCDATA)>

<!ELEMENT relationship (description?, locator?, comp1alias, comp2alias, property*)>
<!ATTLIST relationship
	action (update_or_create | update | find | create | delete) "update_or_create"
	type CDATA #REQUIRED
	description CDATA #IMPLIED
	alias CDATA #IMPLIED
	uuid CDATA #IMPLIED
	id CDATA #IMPLIED
	objectUuid CDATA #IMPLIED
>

<!ELEMENT comp1alias EMPTY>
<!ATTLIST comp1alias alias IDREF #REQUIRED>

<!ELEMENT comp2alias EMPTY>
<!ATTLIST comp2alias alias IDREF #REQUIRED>

<!ELEMENT locator (parameter*)>
<!ATTLIST locator class CDATA #IMPLIED>

<!ELEMENT parameter EMPTY>
<!ATTLIST parameter
	name CDATA #REQUIRED
	value CDATA #REQUIRED
>
```
