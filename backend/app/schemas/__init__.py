"""Pydantic request models - every input is validated before it reaches SQL."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal["ADMIN", "LEAD_INVESTIGATOR", "INVESTIGATOR", "AUDITOR"]
CaseStatus = Literal["OPEN", "IN_PROGRESS", "ON_HOLD", "CLOSED"]
Priority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
AssignmentRole = Literal["LEAD", "MEMBER", "REVIEWER"]
AlertStatus = Literal["OPEN", "ACKNOWLEDGED", "DISMISSED", "ESCALATED"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LoginRequest(_Strict):
    email: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def lower(cls, v: str) -> str:
        return v.lower()


class CaseCreate(_Strict):
    case_title: str = Field(min_length=5, max_length=200)
    case_description: Optional[str] = Field(default=None, max_length=5000)
    priority: Priority = "MEDIUM"


class CaseUpdate(_Strict):
    case_title: Optional[str] = Field(default=None, min_length=5, max_length=200)
    case_description: Optional[str] = Field(default=None, max_length=5000)
    priority: Optional[Priority] = None


class CaseStatusUpdate(_Strict):
    case_status: CaseStatus


class AssignmentCreate(_Strict):
    investigator_id: int = Field(gt=0)
    assignment_role: AssignmentRole = "MEMBER"


class CustodyTransferCreate(_Strict):
    evidence_id: int = Field(gt=0)
    to_investigator_id: int = Field(gt=0)
    transfer_reason: str = Field(min_length=5, max_length=300)


class InvestigatorCreate(_Strict):
    investigator_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=6, max_length=150, pattern=r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
    role: Role = "INVESTIGATOR"
    password: str = Field(min_length=10, max_length=200)


    @field_validator("email")
    @classmethod
    def lower(cls, v: str) -> str:
        return v.lower()


class InvestigatorUpdate(_Strict):
    role: Optional[Role] = None
    is_active: Optional[bool] = None


class RuleUpdate(_Strict):
    threshold: Optional[float] = Field(default=None, gt=0, le=100000)
    window_minutes: Optional[int] = Field(default=None, ge=1, le=10080)
    base_score: Optional[int] = Field(default=None, ge=0, le=100)
    is_enabled: Optional[bool] = None
    start_hour: Optional[int] = Field(default=None, ge=0, le=23)
    end_hour: Optional[int] = Field(default=None, ge=1, le=24)


class AlertStatusUpdate(_Strict):
    status: AlertStatus


class AssistantContext(_Strict):
    table_name: Optional[Literal["cases", "evidence", "case_assignments", "investigators",
                                 "custody_transfers", "integrity_checks"]] = None
    record_id: Optional[int] = Field(default=None, gt=0)
    case_id: Optional[int] = Field(default=None, gt=0)
    evidence_id: Optional[int] = Field(default=None, gt=0)


class AssistantQuery(_Strict):
    question: str = Field(min_length=2, max_length=500)
    context: Optional[AssistantContext] = None
    use_llm: bool = True
