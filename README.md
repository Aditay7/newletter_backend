# Newsletter Backend API

This is a NestJS-based backend API for a newsletter application. It supports multi-tenancy (organizations), user management, campaign management, email sending, and click tracking.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Docker](https://www.docker.com/) & Docker Compose (for the database)

## Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd newsletter_api
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

The application uses environment variables for configuration. You need to create a `.env` file in the `src/` directory.

1.  Create `src/.env` (or `src/.development.env` if `NODE_ENV` is set to `development`):

    ```bash
    touch src/.env
    ```

2.  Add the following configuration to the file:

    ```env
    # Database Configuration
    DATABASE_HOST=localhost
    DATABASE_PORT=5432
    DATABASE_USER=postgres
    DATABASE_PASSWORD=postgres
    DATABASE_NAME=newsletter_db

    # Authentication
    JWT_SECRET=your_super_secret_jwt_key
    JWT_EXPIRATION=1d

    # Email Configuration (SMTP)
    # Example for Gmail (requires App Password if 2FA is on)
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your_email@gmail.com
    SMTP_PASSWORD=your_email_password
    SMTP_FROM_EMAIL=noreply@newsletter.com
    ```

    > **Note:** The `docker-compose.yml` file is configured to use `src/.env` to set up the PostgreSQL container. Ensure the database credentials match.

## Running the Application

### 1. Start the Database

Use Docker Compose to start the PostgreSQL database:

```bash
docker-compose up -d
```

This will start a Postgres container on port `5432`.

### 2. Start the API Server

Run the application in development mode:

```bash
npm run start:dev
```

The server will start on `http://localhost:8000`.
The global API prefix is `/api`.

## Testing

### Unit & Integration Tests

Run the standard Jest tests:

```bash
npm test
```

### End-to-End (E2E) Tests

Run the E2E tests:

```bash
npm run test:e2e
```

### Feature Testing Scripts

There are several shell scripts in the `test_scripts/` directory to test specific features against a running API.

Ensure the API is running (`npm run start:dev`) before running these scripts.

```bash
# Test all features
./test_scripts/test-all-features.sh

# Test authentication flow
./test_scripts/test-auth.sh

# Test multi-tenancy
./test_scripts/test-multi-tenancy.sh
```

## Project Structure

The source code is located in the `src/` directory, organized by modules:

-   **auth/**: Authentication logic (JWT strategy, guards).
-   **campaigns/**: Email campaign management.
-   **click_stats/**: Tracking clicks on links in emails.
-   **email/**: Email sending service (using Nodemailer).
-   **gpg/**: GPG encryption for secure emails.
-   **lists/**: Subscriber list management.
-   **organizations/**: Multi-tenancy organization management.
-   **rss/**: RSS feed integration.
-   **subscribers/**: Subscriber management.
-   **tasks/**: Scheduled tasks (Cron jobs).
-   **templates/**: Email template management.
-   **users/**: User management.

## API Documentation

The API runs at `http://localhost:8000/api`.

(If Swagger is enabled, you can visit `http://localhost:8000/api/docs` - *Note: Check `main.ts` if Swagger is set up, otherwise use the provided Postman collection `NestJS.postman_collection.json`*)

## License

[UNLICENSED](LICENSE)
