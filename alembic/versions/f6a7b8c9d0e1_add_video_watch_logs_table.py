"""add_video_watch_logs_table

Revision ID: f6a7b8c9d0e1
Revises: e3000fa8693a
Create Date: 2026-03-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e3000fa8693a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('video_watch_logs',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('patient_id', sa.Integer(), nullable=False),
    sa.Column('exercise_id', sa.String(), nullable=False),
    sa.Column('watch_percentage', sa.Float(), nullable=False, server_default='0'),
    sa.Column('watched_date', sa.Date(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('patient_id', 'exercise_id', 'watched_date', name='uq_patient_video_date')
    )
    with op.batch_alter_table('video_watch_logs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_video_watch_logs_patient_id'), ['patient_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('video_watch_logs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_video_watch_logs_patient_id'))

    op.drop_table('video_watch_logs')
