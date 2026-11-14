import { beforeEach } from "vitest";
import { TEST_DATABASE_URL, resetDatabase } from "@/test-utils/shared/test-database";

/**
 * setupFiles of the Vitest `db` project, run before each test file. The app already connects to the test database
 * (`.env.test` is the environment of every test); every test starts from an empty database and creates its own data.
 */

beforeEach(() => resetDatabase(TEST_DATABASE_URL));
