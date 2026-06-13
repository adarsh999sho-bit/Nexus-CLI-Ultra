import type { DatabaseSchema } from "./types";
import { getLogger } from "../shared/logger";

export class SchemaInferrer {
  private log = getLogger();

  /** Infer database schema from source files */
  inferFromFiles(files: Array<{ path: string; content: string }>): DatabaseSchema {
    const tables: DatabaseSchema["tables"] = [];
    const relationships: DatabaseSchema["relationships"] = [];

    for (const file of files) {
      const content = file.content;

      // Detect Prisma schema definitions
      const prismaTables = this.detectPrismaModels(content);
      tables.push(...prismaTables);

      // Detect TypeORM/Drizzle entity definitions
      const ormTables = this.detectOrmEntities(content);
      tables.push(...ormTables);

      // Detect Knex/raw schema definitions
      const knexTables = this.detectCreateTableStatements(content);
      tables.push(...knexTables);

      // Detect relationships between tables
      const rels = this.detectRelationships(content);
      relationships.push(...rels);
    }

    return { tables, relationships };
  }

  /** Detect Prisma models */
  private detectPrismaModels(content: string): DatabaseSchema["tables"] {
    const tables: DatabaseSchema["tables"] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = modelRegex.exec(content)) !== null) {
      const tableName = match[1];
      const body = match[2];
      const columns = this.parseColumns(body, "prisma");
      tables.push({ name: tableName, columns });
    }

    return tables;
  }

  /** Detect ORM entity definitions */
  private detectOrmEntities(content: string): DatabaseSchema["tables"] {
    const tables: DatabaseSchema["tables"] = [];
    const entityRegex = /@Entity\s*(?:\([^)]*\))?\s*\n\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    const propRegex = /@Column\s*(?:\([^)]*\))?\s*\n\s*(?:\w+\s+)?(\w+)\s*[:=]\s*(\w+)/g;
    
    let match: RegExpExecArray | null;
    while ((match = entityRegex.exec(content)) !== null) {
      const tableName = match[1];
      const columns = this.parseColumns(content.slice(match.index), "orm");
      tables.push({ name: tableName, columns });
    }

    return tables;
  }

  /** Detect CREATE TABLE statements */
  private detectCreateTableStatements(content: string): DatabaseSchema["tables"] {
    const tables: DatabaseSchema["tables"] = [];
    const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([^)]+)\)/gi;
    
    let match: RegExpExecArray | null;
    while ((match = createRegex.exec(content)) !== null) {
      const tableName = match[1];
      const columns = this.parseColumns(match[2], "sql");
      tables.push({ name: tableName, columns });
    }

    return tables;
  }

  /** Detect relationships between tables */
  private detectRelationships(content: string): DatabaseSchema["relationships"] {
    const relationships: DatabaseSchema["relationships"] = [];
    
    // Prisma relations
    const prismaRel = /(\w+)\s+(\w+)\s+@relation\s*\([^)]*fields:\s*\[(\w+)\][^)]*references:\s*\[(\w+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = prismaRel.exec(content)) !== null) {
      relationships.push({
        from: match[1],
        fromColumn: match[3],
        to: match[2],
        toColumn: match[4],
      });
    }

    // Foreign key references
    const fkRel = /FOREIGN\s+KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)/gi;
    while ((match = fkRel.exec(content)) !== null) {
      const fromTableGuess = "current_table";
      relationships.push({
        from: fromTableGuess,
        fromColumn: match[1],
        to: match[2],
        toColumn: match[3],
      });
    }

    return relationships;
  }

  /** Parse column definitions */
  private parseColumns(body: string, dialect: "prisma" | "orm" | "sql"): DatabaseSchema["tables"][0]["columns"] {
    const columns: DatabaseSchema["tables"][0]["columns"] = [];
    const lines = body.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("}")) continue;

      let name = "";
      let type = "";
      let nullable = true;
      let primaryKey = false;
      let foreignKey: string | undefined;

      if (dialect === "prisma") {
        const match = trimmed.match(/(\w+)\s+(\w+)/);
        if (match) {
          name = match[1];
          type = match[2];
          nullable = trimmed.includes("?");
          primaryKey = trimmed.includes("@id");
        }
      } else if (dialect === "sql") {
        const match = trimmed.match(/(\w+)\s+(\w+)/);
        if (match) {
          name = match[1];
          type = match[2];
          nullable = !trimmed.toUpperCase().includes("NOT NULL");
          primaryKey = trimmed.toUpperCase().includes("PRIMARY KEY");
        }
      }

      if (name && type) {
        columns.push({ name, type, nullable, primaryKey, foreignKey });
      }
    }

    return columns;
  }

  /** Generate a Mermaid ERD diagram from the schema */
  toMermaidERD(schema: DatabaseSchema): string {
    const lines: string[] = ["erDiagram;"];

    for (const table of schema.tables) {
      for (const col of table.columns) {
        const pk = col.primaryKey ? " PK" : "";
        const nullable = col.nullable ? "" : " NOT NULL";
        lines.push(`  ${table.name} {`);
        lines.push(`    ${col.type} ${col.name}${pk}${nullable}`);
        lines.push(`  }`);
      }
    }

    for (const rel of schema.relationships) {
      lines.push(`  ${rel.from} ||--o{ ${rel.to} : "has"`);
    }

    return lines.join("\n");
  }
}
