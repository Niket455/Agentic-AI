"""add document chunks

Revision ID: 3e1d6756e78d
Revises: 1af4e843e98d
Create Date: 2026-09-05 16:03:58.263888

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e1d6756e78d'
down_revision: Union[str, Sequence[str], None] = '1af4e843e98d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["documents.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_document_chunks_id"),
        "document_chunks",
        ["id"],
        unique=False,
    )

    with op.batch_alter_table("documents") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.VARCHAR(),
            nullable=False,
        )

def downgrade() -> None:
    with op.batch_alter_table("documents") as batch_op:
        batch_op.alter_column(
            "status",
            existing_type=sa.VARCHAR(),
            nullable=True,
        )

    op.drop_index(
        op.f("ix_document_chunks_id"),
        table_name="document_chunks",
    )

    op.drop_table("document_chunks")