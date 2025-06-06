
/** @odoo-module */

import { registry } from "@web/core/registry";
import { ormService } from "@web/core/orm_service";
import { serializeDateTime } from "@web/core/l10n/dates";
import {
    click,
    clickOpenM2ODropdown,
    editInput,
    getFixture,
    nextTick,
} from "@web/../tests/helpers/utils";

import { start } from "@mail/../tests/helpers/test_utils";

import { setupTestEnv } from "@hr_timesheet/../tests/hr_timesheet_common_tests";
import { timesheetGridUOMService } from "@timesheet_grid/services/timesheet_grid_uom_service";

import { TimesheetGridSetupHelper } from "./helpers";

const { DateTime } = luxon;

let serverData, target, timesheetGridSetup;

QUnit.module("Views", (hooks) => {
    hooks.beforeEach(async () => {
        timesheetGridSetup = new TimesheetGridSetupHelper(true);
        const result = await timesheetGridSetup.setupTimesheetGrid();
        serverData = result.serverData;
        let grid = serverData.views["analytic.line,false,grid"].replace(
            'js_class="timesheet_grid"',
            'js_class="timer_timesheet_grid"'
        );
        grid = grid.replace('widget="float_time"', 'widget="timesheet_uom"');
        serverData.views["analytic.line,false,grid"] = grid;
        grid = serverData.views["analytic.line,1,grid"].replace(
            'js_class="timesheet_grid"',
            'js_class="timer_timesheet_grid"'
        );
        grid = grid.replace('widget="float_time"', 'widget="timesheet_uom"');
        serverData.views["analytic.line,1,grid"] = grid;

        target = getFixture();
        setupTestEnv();
        const serviceRegistry = registry.category("services");
        serviceRegistry.add("orm", ormService, { force: true });
        const gridComponentsRegistry = registry.category("grid_components");
        if (gridComponentsRegistry.contains("timesheet_uom")) {
            gridComponentsRegistry.remove("timesheet_uom"); // the component will be added by timesheet_grid_uom_service
        }
        serviceRegistry.add("timesheet_grid_uom", timesheetGridUOMService, { force: true });
    });

    QUnit.module("TimesheetTimerKanbanView");

    QUnit.test("Switch view with GroupBy and start the timer", async function (assert) {
        serverData.views["analytic.line,1,kanban"] =
            `<kanban js_class="timesheet_timer_kanban">
                <templates>
                    <field name="name"/>
                    <t t-name="card">
                        <field name="employee_id"/>
                        <field name="project_id"/>
                        <field name="task_id"/>
                        <field name="date"/>
                        <field name="display_timer"/>
                        <field name="unit_amount"/>
                    </t>
                </templates>
            </kanban>`;

        const { openView } = await start({
            serverData,
            async mockRPC(route, { method }) {
                switch (method) {
                    case "get_running_timer":
                        return { step_timer: 30 };
                    case "action_start_new_timesheet_timer":
                        return false;
                    case "get_daily_working_hours":
                        return {};
                    case "get_server_time":
                        return serializeDateTime(DateTime.now());
                    case "get_create_edit_project_ids":
                        return [];
                    default:
                        return timesheetGridSetup.mockTimesheetGridRPC(...arguments);
                }
            }
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "grid"], [false, "kanban"]],
            context: { group_by: ["project_id", "task_id"] },
        });
        await nextTick();
        await click(target, ".o_switch_view.o_kanban");
        await nextTick();
        await click(target, ".btn_start_timer");
        assert.containsNone(
            target,
            "button.btn_start_timer",
            "Timer should be running"
        );
    });

    QUnit.test("Start timer, set fields and switch view", async function (assert) {
        let timerRunning = false;
        serverData.views["analytic.line,1,kanban"] =
            `<kanban js_class="timesheet_timer_kanban">
                <templates>
                    <field name="name"/>
                    <t t-name="card">
                        <field name="employee_id"/>
                        <field name="project_id"/>
                        <field name="task_id"/>
                        <field name="date"/>
                        <field name="display_timer"/>
                        <field name="unit_amount"/>
                    </t>
                </templates>
            </kanban>`;

        const { openView } = await start({
            serverData,
            async mockRPC(route, { method }) {
                switch (method) {
                    case "get_running_timer":
                        const result = { step_timer: 30 };
                        if (timerRunning) {
                            result.id = 4;
                        }
                        return result;
                    case "action_start_new_timesheet_timer":
                        timerRunning = true;
                        return { id: 4 };
                    case "get_daily_working_hours":
                        return {};
                    case "get_server_time":
                        return serializeDateTime(DateTime.now());
                    case "get_create_edit_project_ids":
                        return [];
                    default:
                        return timesheetGridSetup.mockTimesheetGridRPC(...arguments);
                }
            }
        });

        await openView({
            res_model: "analytic.line",
            views: [[false, "kanban"], [false, "grid"]],
        });
        await nextTick();
        await click(target, ".btn_start_timer");
        await editInput(target, ".o_field_char[name='name'] input", "Test");
        await clickOpenM2ODropdown(target, "task_id");
        await click(target, ".o_field_many2one[name='task_id'] li:nth-of-type(1) a");
        await click(target, ".o_switch_view.o_grid");
        assert.equal(
            target.querySelector(".o_field_char[name='name'] input").value,
            "Test",
            "Description shouldn't have changed by switching view"
        );
        assert.equal(
            target.querySelector(".o_field_many2one[name='task_id'] input").value,
            "BS task",
            "Task shouldn't have changed by switching view"
        );
    });
})
