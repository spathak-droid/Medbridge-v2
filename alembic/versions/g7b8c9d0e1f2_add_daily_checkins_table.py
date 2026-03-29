"""add daily_checkins table

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'daily_checkins',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('patient_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('pain_level', sa.Integer(), nullable=False),
        sa.Column('mood_level', sa.Integer(), nullable=False),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('patient_id', 'date', name='uq_patient_checkin_date'),
    )
    op.create_index(op.f('ix_daily_checkins_patient_id'), 'daily_checkins', ['patient_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_daily_checkins_patient_id'), table_name='daily_checkins')
    op.drop_table('daily_checkins')
