"""add_clinical_notes_table

Revision ID: d4e5f6a7b8c9
Revises: c3d8f1a25b02
Create Date: 2026-03-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d8f1a25b02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('clinical_notes',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('patient_id', sa.Integer(), nullable=False),
    sa.Column('clinician_uid', sa.String(255), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('clinical_notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_clinical_notes_patient_id'), ['patient_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('clinical_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_clinical_notes_patient_id'))

    op.drop_table('clinical_notes')
