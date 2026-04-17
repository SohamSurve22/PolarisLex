# Polarislex

A deterministic, modular, and high-performance document compliance and asset management system. Asset Manager leverages a sophisticated multi-stage pipeline to process legal and financial documents, ensuring strict compliance with defined rules through deterministic parsing and validation.

## 🚀 Features

- **Multi-Stage Document Pipeline**: Structured flow from OCR to normalization, rule application, and violation reporting.
- **Deterministic Compliance Engine**: Rule-based validation (Logical, Temporal, Format) without the unpredictability of LLMs for core logic.
- **Advanced OCR & Parsing**: Robust extraction of document metadata and text using regex-based normalization.
- **Modern Tech Stack**: Built with React, TypeScript, Express, and a modular monorepo architecture.
- **Detailed Violation Reporting**: Traceable citations including Act, Section, and Explanations for each non-compliance.

## 🛠️ Architecture

The project is structured as an npm workspaces monorepo:

- **`frontend/` (`@workspace/polarislex`)**: React application powered by Vite, Tailwind CSS, and Shadcn UI.
- **`backend/server/` (`@workspace/api-server`)**: Express.js API server handling orchestration and file uploads.
- **`backend/parser/` (`@workspace/parser`)**: Core logic for OCR integration and regex-based data normalization.
- **`backend/rules/` (`@workspace/rules`)**: Deterministic rule engine for validating document compliance.
- **`backend/db/` (`@workspace/db`)**: Shared database schemas and connection management (Drizzle/Mongoose).

## 🚦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- MongoDB / PostgreSQL instances (see Configuration)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Asset-Manager-1
   ```

2. Install dependencies for the entire workspace:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your specific database URIs and keys
   ```

### Running the Application

To start both the backend server and frontend application concurrently:

```bash
npm start
```

For individual packages:

```bash
# Start backend server only
npm run dev -w @workspace/api-server

# Start frontend only
npm run dev -w @workspace/polarislex
```

## 🏗️ Building for Production

To build all packages in the workspace:

```bash
npm run build
```

The build artifacts will be generated in their respective `dist` folders.
