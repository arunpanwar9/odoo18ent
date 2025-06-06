# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, _
from odoo.exceptions import UserError


class sale_order(models.Model):

    _inherit = "sale.order"

    def _prepare_purchase_order_data(self, company, company_partner):
        res = super()._prepare_purchase_order_data(company, company_partner)
        # find location and warehouse, pick warehouse from company object
        warehouse = company.intercompany_warehouse_id if company.intercompany_warehouse_id.company_id.id == company.id else False
        if not warehouse:
            raise UserError(
                _('Configure correct warehouse for company(%s) from Menu: Settings/Users/Companies', company.name))
        picking_type_id = company.intercompany_receipt_type_id
        if not picking_type_id:
            picking_type_id = self.env['stock.picking.type'].search([
                ('code', '=', 'incoming'), ('warehouse_id', '=', warehouse.id)
            ], limit=1)
        if not picking_type_id:
            intercompany_uid = company.intercompany_user_id.id
            picking_type_id = self.env['purchase.order'].with_user(intercompany_uid)._default_picking_type()

        res['picking_type_id'] = picking_type_id.id

        return res
