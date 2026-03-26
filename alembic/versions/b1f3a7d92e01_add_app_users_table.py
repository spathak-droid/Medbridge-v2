"""add app_users table for role storage

Revision ID: b1f3a7d92e01
Revises: a82dc343728b
Create Date: 2026-03-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1f3a7d92e01'
down_revision: Union[str, Sequence[str], None] = 'a82dc343728b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'app_users',
        sa.Column('firebase_uid', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False, server_default='patient'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                   server_default=sa.text("(now())")),
        sa.PrimaryKeyConstraint('firebase_uid'),
    )


def downgrade() -> None:
    op.drop_table('app_users')
