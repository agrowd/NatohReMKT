# Changelog

## [0.1.0] - 2026-05-06
### Added
- Ariadne Engine Cortex Initialized.
- WhatsApp Remarketing System (Backend & Frontend).
- Sequential Flow Builder with Media Support.
- SQLite persistence for flows and campaigns.
- Debian VPS setup script.

## [0.3.0] - 2026-06-11
### Added
- Local Virtual Lists backend API and database schemas.
- High-efficiency VCF (vCard) and CSV phone contacts importers.
- Quoted-Printable UTF-8 decoding for vCard names.
- Argentinian mobile number normalization (stripping intermediate 15 prefix and resolving area codes).
- Unified Campaign launcher combining native WA labels and virtual lists with de-duplication.
- Frontend sidebar listing for Virtual Lists and management actions.
- Drag-and-drop file upload interface for importing agenda files.
## [0.4.0] - 2026-06-17
### Added
- Standalone navigation tab "Importador VCF/CSV" (Icon: paperclip) for clean user experience.
- Automated creation of new Virtual Lists directly from the VCF/CSV import form.
- Direct keyword/name filtering (e.g. "luz pulsada") during the VCF import process.
- Database logs check during import to automatically exclude contacts that already received messages.
- Cleaned up duplicate file upload interfaces from other tabs.
## [0.5.0] - 2026-06-29
### Added
- Backend route `POST /api/campaigns/stop` to safely cancel active campaigns.
- Interval check helper `delayWithCancelCheck` to allow immediate loop exits during delays.
- "DETENER" button inside the top bar progress tracker in the React frontend.
