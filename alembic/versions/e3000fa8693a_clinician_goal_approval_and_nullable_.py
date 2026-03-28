"""clinician goal approval and nullable external_id

Revision ID: e3000fa8693a
Revises: e5f6a7b8c9d0
Create Date: 2026-03-28 15:41:27.510275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3000fa8693a'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('goals', schema=None) as batch_op:
        batch_op.add_column(sa.Column('clinician_approved', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        batch_op.add_column(sa.Column('clinician_rejected', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        batch_op.add_column(sa.Column('rejection_reason', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.alter_column('external_id',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.alter_column('external_id',
               existing_type=sa.VARCHAR(),
               nullable=False)

    with op.batch_alter_table('goals', schema=None) as batch_op:
        batch_op.drop_column('reviewed_at')
        batch_op.drop_column('rejection_reason')
        batch_op.drop_column('clinician_rejected')
        batch_op.drop_column('clinician_approved')
