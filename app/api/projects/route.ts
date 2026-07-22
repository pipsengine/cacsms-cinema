import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET all projects
export async function GET(request: NextRequest) {
  try {
    const projects = await prisma.project.findMany({
      include: {
        jobs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST create new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
      },
      include: {
        jobs: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
