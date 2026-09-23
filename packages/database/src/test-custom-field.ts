import { prisma, CustomFieldType } from './index';

async function verifyCustomFieldDefinition() {
  console.log('--- Verifying CustomFieldDefinition and CustomFieldType ---');

  const testNamePrefix = `test_field_${Date.now()}`;

  try {
    // 1. Create a TEXT custom field definition with defaults
    const textDef = await prisma.customFieldDefinition.create({
      data: {
        name: `${testNamePrefix}_text`,
        label: 'Data License Type',
        description: 'License under which the data source is published',
        type: CustomFieldType.TEXT,
        filterable: true,
        searchable: true,
      },
    });
    console.log(`✓ Created TEXT CustomFieldDefinition: ${textDef.name} (id: ${textDef.id})`);

    // 2. Create a SELECT custom field definition with JSON options
    const selectOptions = [
      { label: 'Creative Commons CC-BY', value: 'cc_by' },
      { label: 'Open Data Commons (ODC-BY)', value: 'odc_by' },
      { label: 'Public Domain (CC0)', value: 'cc0' },
      { label: 'Proprietary / Restricted', value: 'proprietary' },
    ];

    const selectDef = await prisma.customFieldDefinition.create({
      data: {
        name: `${testNamePrefix}_select`,
        label: 'Openness Level',
        description: 'Categorization of data accessibility and openness',
        type: CustomFieldType.SELECT,
        filterable: true,
        searchable: false,
        required: true,
        options: selectOptions,
      },
    });
    console.log(`✓ Created SELECT CustomFieldDefinition: ${selectDef.name} with options JSON.`);

    // 3. Verify querying and field values
    const fetchedSelect = await prisma.customFieldDefinition.findUnique({
      where: { name: `${testNamePrefix}_select` },
    });

    if (!fetchedSelect) {
      throw new Error('Failed to find created select custom field definition');
    }
    if (fetchedSelect.type !== CustomFieldType.SELECT) {
      throw new Error(`Expected SELECT type, got ${fetchedSelect.type}`);
    }
    if (fetchedSelect.required !== true) {
      throw new Error(`Expected required=true, got ${fetchedSelect.required}`);
    }
    if (!Array.isArray(fetchedSelect.options) || fetchedSelect.options.length !== 4) {
      throw new Error('Options JSON was not stored or retrieved properly');
    }
    console.log('✓ Successfully retrieved SELECT definition and verified options JSON!');

    // 4. Verify uniqueness constraint on name
    let duplicateRejected = false;
    try {
      await prisma.customFieldDefinition.create({
        data: {
          name: `${testNamePrefix}_text`, // duplicate name
          label: 'Duplicate Name Test',
          type: CustomFieldType.TEXT,
        },
      });
    } catch {
      duplicateRejected = true;
      console.log('✓ Duplicate name properly rejected by PostgreSQL unique constraint.');
    }

    if (!duplicateRejected) {
      throw new Error('Duplicate name did not trigger expected uniqueness error');
    }

    // 5. Test filtering by filterable index
    const filterableDefs = await prisma.customFieldDefinition.findMany({
      where: {
        name: { in: [textDef.name, selectDef.name] },
        filterable: true,
      },
    });
    if (filterableDefs.length !== 2) {
      throw new Error(`Expected 2 filterable definitions, found ${filterableDefs.length}`);
    }
    console.log(`✓ Filterable indexed query returned ${filterableDefs.length} definitions.`);

    // 6. Cleanup
    await prisma.customFieldDefinition.deleteMany({
      where: { id: { in: [textDef.id, selectDef.id] } },
    });
    console.log('✓ Test cleanup completed.');
  } catch (err) {
    // Attempt cleanup on failure
    await prisma.customFieldDefinition
      .deleteMany({
        where: { name: { startsWith: testNamePrefix } },
      })
      .catch(() => {});
    throw err;
  }
}

verifyCustomFieldDefinition()
  .then(() => {
    console.log('CustomFieldDefinition testing PASSED.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('CustomFieldDefinition testing FAILED:', err);
    process.exit(1);
  });
