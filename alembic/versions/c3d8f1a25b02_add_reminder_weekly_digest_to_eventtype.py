"""add REMINDER and WEEKLY_DIGEST to eventtype enum

Revision ID: c3d8f1a25b02
Revises: b1f3a7d92e01
Create Date: 2026-03-26 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3d8f1a25b02'
down_revision: Union[str, Sequence[str], None] = 'b1f3a7d92e01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL requires ALTER TYPE to add new enum values.
    # The earlier migration used batch_alter_table which only works in SQLite.
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block,
    # so we commit the current transaction first, run the DDL, then continue.
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        from sqlalchemy import text
        # Commit the alembic transaction so ADD VALUE can run outside a tx block
        conn.execute(text("COMMIT"))
        conn.execute(text("ALTER TYPE eventtype ADD VALUE IF NOT EXISTS 'REMINDER'"))
        conn.execute(text("ALTER TYPE eventtype ADD VALUE IF NOT EXISTS 'WEEKLY_DIGEST'"))
        # Re-open a transaction for alembic's version stamp
        conn.execute(text("BEGIN"))


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values; no-op.
    pass
