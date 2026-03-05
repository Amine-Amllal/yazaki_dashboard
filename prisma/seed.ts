import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await prisma.user.upsert({
        where: { matricule: "ADMIN001" },
        update: {},
        create: {
            matricule: "ADMIN001",
            nom: "Admin",
            prenom: "System",
            email: "admin@yazaki.com",
            password: hashedPassword,
            fonction: "PP_COORDINATOR",
            role: "ADMIN",
            active: true,
        },
    });

    // Create demo user
    const userPassword = await bcrypt.hash("user123", 10);
    await prisma.user.upsert({
        where: { matricule: "USR001" },
        update: {},
        create: {
            matricule: "USR001",
            nom: "Benali",
            prenom: "Mohamed",
            email: "m.benali@yazaki.com",
            password: userPassword,
            fonction: "PP_RESPONSIBLE",
            role: "USER",
            active: true,
        },
    });

    // Create projects
    const projects = ["Renault", "Peugeot", "Stellantis", "Volkswagen", "Ford"];
    for (const name of projects) {
        await prisma.project.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }

    const families = [
        "CABLAGE PORTE AR D",
        "CABLAGE PORTE AR G",
        "CABLAGE PORTE AV D",
        "CABLAGE PORTE AV G",
        "CABLAGE MOTEUR",
        "CABLAGE PRINCIPAL",
        "CABLAGE TABLEAU DE BORD",
    ];
    for (const name of families) {
        await prisma.family.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }

    // Create phases
    const phases = ["PPC", "SOP", "PROTO", "PRE-SERIE", "SERIE"];
    for (const name of phases) {
        await prisma.phase.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }

    // Create some sample DFCs
    const project = await prisma.project.findFirst({ where: { name: "Renault" } });
    const family = await prisma.family.findFirst({ where: { name: "CABLAGE PORTE AR D" } });
    const phase = await prisma.phase.findFirst({ where: { name: "PPC" } });
    const admin = await prisma.user.findFirst({ where: { matricule: "ADMIN001" } });

    if (project && family && phase && admin) {
        const sampleDFCs = [
            {
                description: "Section Change - Modification de la section du câble principal",
                faisabilite: "OUI",
                typeDFC: "T1",
                dateReception: new Date("2026-01-15"),
                dateReponse: new Date("2026-01-20"),
                delaiReponse: 5,
                numeroDerogation: "DRG1111111-1",
                dateReceptionDerogation: new Date("2026-01-22"),
                dateApplicationEstimee: new Date("2026-02-15"),
                commentaire: "Modification validée et appliquée",
            },
            {
                description: "Changement de connecteur - Remplacement du connecteur 24 broches",
                faisabilite: "EN_COURS",
                typeDFC: "T2",
                dateReception: new Date("2026-01-28"),
                dateReponse: null,
                delaiReponse: null,
                commentaire: "En attente de validation technique",
            },
            {
                description: "Ajout de circuit - Nouveau circuit pour capteur de température",
                faisabilite: "NON",
                typeDFC: "T1",
                dateReception: new Date("2026-02-01"),
                dateReponse: new Date("2026-02-05"),
                delaiReponse: 4,
                commentaire: "Non faisable - contrainte d'espace",
            },
            {
                description: "Modification routage - Changement du parcours câble zone moteur",
                faisabilite: "A_CLARIFIER",
                typeDFC: "T3",
                dateReception: new Date("2026-02-05"),
                dateReponse: null,
                delaiReponse: null,
                commentaire: "Nécessite clarification avec le client",
            },
            {
                description: "Remplacement gaine - Passage en gaine thermorétractable",
                faisabilite: "OUI",
                typeDFC: "T1",
                dateReception: new Date("2026-02-08"),
                dateReponse: new Date("2026-02-10"),
                delaiReponse: 2,
                numeroDerogation: "DRG2222222-1",
                dateReceptionDerogation: new Date("2026-02-12"),
                dateApplicationEstimee: new Date("2026-03-01"),
                commentaire: "Validé - en cours d'application",
            },
        ];

        for (let i = 0; i < sampleDFCs.length; i++) {
            await prisma.dFC.upsert({
                where: { numero: i + 1 },
                update: {},
                create: {
                    numero: i + 1,
                    projectId: project.id,
                    familyId: family.id,
                    phaseId: phase.id,
                    createdById: admin.id,
                    ...sampleDFCs[i],
                },
            });
        }
    }

    console.log("✅ Database seeded successfully!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
