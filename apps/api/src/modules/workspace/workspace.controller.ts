import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspace')
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('catalog')
  catalog() {
    return this.workspace.catalog();
  }

  @Get('plans/:planVersionId')
  plan(@Param('planVersionId') planVersionId: string) {
    return this.workspace.planDetail(planVersionId);
  }

  @Get('research/:projectId')
  research(@Param('projectId') projectId: string) {
    return this.workspace.researchDetail(projectId);
  }

  @Get('scripts/:projectId')
  script(@Param('projectId') projectId: string) {
    return this.workspace.scriptDetail(projectId);
  }
}
